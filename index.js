#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const { program } = require('commander');

program
    .name('youtube-audio-merger')
    .description('Download and merge audio from YouTube videos with specific time ranges')
    .version('1.0.0')
    .option('-i, --input <path>', 'Path to input file with YouTube URLs and timestamps')
    .option('-o, --output <filename>', 'Output filename', 'merged_audio.mp3')
    .option('-f, --format <format>', 'Output audio format', 'mp3')
    .option('-b, --bitrate <bitrate>', 'Output audio bitrate', '128k')
    .parse(process.argv);

const options = program.opts();

// Temporary directory for downloaded files
const TEMP_DIR = path.join(process.cwd(), 'temp_audio_files');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

async function parseInput() {
    const entries = [];

    if (options.input) {
        // Read from file
        const fileContent = fs.readFileSync(options.input, 'utf8');
        const lines = fileContent.split('\n').filter(line => line.trim());

        for (const line of lines) {
            // Expected format: https://youtube.com/watch?v=VIDEOID 00:00 02:30
            const parts = line.trim().split(' ');
            if (parts.length >= 3) {
                entries.push({
                    url: parts[0],
                    start: parts[1],
                    end: parts[2]
                });
            }
        }
    } else {
        // Interactive mode if no input file provided
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('Enter YouTube URLs with start and end times (empty line to finish):');
        console.log('Format: https://youtube.com/watch?v=VIDEOID 00:00 02:30');

        let line;
        do {
            line = await new Promise(resolve => rl.question('> ', resolve));
            if (line.trim()) {
                const parts = line.trim().split(' ');
                if (parts.length >= 3) {
                    entries.push({
                        url: parts[0],
                        start: parts[1],
                        end: parts[2]
                    });
                } else {
                    console.log('Invalid format. Please use: URL START_TIME END_TIME');
                }
            }
        } while (line.trim());

        rl.close();
    }

    return entries;
}

// Convert time format (00:00:00 or 00:00) to seconds
function timeToSeconds(time) {
    const parts = time.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else {
        return Number(time);
    }
}

// Extract video ID from different YouTube URL formats
function getVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function processVideo(entry, index) {
    const { url, start, end } = entry;

    try {
        const videoId = getVideoId(url);
        if (!videoId) {
            throw new Error('Could not extract video ID from URL');
        }

        const standardUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const info = await ytdl.getInfo(standardUrl, {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                }
            }
        });

        const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '');

        console.log(`\nProcessing (${index + 1}): ${videoTitle}`);

        // Filenames
        const tempFullAudio = path.join(TEMP_DIR, `${videoId}_full.mp3`);
        const tempClipAudio = path.join(TEMP_DIR, `${videoId}_clip.mp3`);

        console.log('Downloading audio...');

        return new Promise((resolve, reject) => {
            const stream = ytdl(standardUrl, {
                quality: 'highestaudio',
                filter: 'audioonly',
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    }
                }
            });

            stream.on('error', (err) => {
                console.error(`Error streaming from YouTube: ${err.message}`);
                reject(err);
            });

            const fileStream = fs.createWriteStream(tempFullAudio);
            fileStream.on('error', (err) => {
                console.error(`Error writing file: ${err.message}`);
                reject(err);
            });

            stream.pipe(fileStream)
                .on('finish', () => {
                    console.log('Extracting clip...');

                    const startSeconds = timeToSeconds(start);
                    const endSeconds = timeToSeconds(end);
                    const duration = endSeconds - startSeconds;

                    // Use ffmpeg to extract the clip with the specified time range
                    ffmpeg(tempFullAudio)
                        .setStartTime(startSeconds)
                        .setDuration(duration)
                        .output(tempClipAudio)
                        .on('end', () => {
                            // Clean up the full audio file
                            try {
                                fs.unlinkSync(tempFullAudio);
                            } catch (err) {
                                console.warn(`Warning: Could not delete temporary file ${tempFullAudio}: ${err.message}`);
                            }

                            resolve({
                                file: tempClipAudio,
                                title: videoTitle,
                                start,
                                end
                            });
                        })
                        .on('error', (err) => {
                            console.error(`Error processing clip: ${err.message}`);
                            reject(err);
                        })
                        .run();
                });
        });
    } catch (error) {
        console.error(`Failed to process ${url}: ${error.message}`);
        throw error;
    }
}

// Merge all audio files into one file
function mergeAudioFiles(clips, outputFilename) {
    return new Promise((resolve, reject) => {
        console.log('\nMerging audio clips...');

        if (clips.length === 0) {
            console.error('No clips to merge');
            reject(new Error('No clips to merge'));
            return;
        }

        if (clips.length === 1) {
            fs.copyFileSync(clips[0].file, outputFilename);
            console.log(`\nSingle clip saved to: ${outputFilename}`);

            fs.unlinkSync(clips[0].file);

            if (fs.readdirSync(TEMP_DIR).length === 0) {
                fs.rmdirSync(TEMP_DIR);
            }

            resolve();
            return;
        }

        const merger = ffmpeg();

        clips.forEach(clip => {
            merger.input(clip.file);
        });

        merger
            .mergeToFile(outputFilename, TEMP_DIR)
            .outputOptions(`-b:a ${options.bitrate}`)
            .on('start', () => {
                console.log('Starting merge process...');
            })
            .on('progress', progress => {
                const percent = Math.min(Math.floor(progress.percent || 0), 100);
                process.stdout.write(`Merging: ${percent}%\r`);
            })
            .on('end', () => {
                console.log(`\nMerge complete! Audio saved to: ${outputFilename}`);

                // Clean up temp files
                clips.forEach(clip => {
                    try {
                        fs.unlinkSync(clip.file);
                    } catch (err) {
                        console.warn(`Warning: Could not delete temporary file ${clip.file}: ${err.message}`);
                    }
                });

                // Remove temp directory if empty
                try {
                    if (fs.readdirSync(TEMP_DIR).length === 0) {
                        fs.rmdirSync(TEMP_DIR);
                    }
                } catch (err) {
                    console.warn(`Warning: Could not remove temporary directory: ${err.message}`);
                }

                resolve();
            })
            .on('error', (err) => {
                console.error(`Error merging files: ${err.message}`);
                reject(err);
            });
    });
}
async function main() {
    try {
        const entries = await parseInput();

        if (entries.length === 0) {
            console.log('No valid entries found. Exiting.');
            return;
        }

        console.log(`Processing ${entries.length} videos...`);

        // Process all videos in sequence
        const processedClips = [];
        for (let i = 0; i < entries.length; i++) {
            try {
                const clip = await processVideo(entries[i], i);
                processedClips.push(clip);
            } catch (error) {
                console.error(`Failed to process entry ${i + 1}: ${error.message}`);
                // Continue with other entries
            }
        }

        if (processedClips.length === 0) {
            console.error('No clips were successfully processed. Exiting.');
            return;
        }

        // Generate output filename with specified format
        const outputFilename = options.output.endsWith(`.${options.format}`)
            ? options.output
            : `${options.output}.${options.format}`;

        // Merge all clips into one file
        await mergeAudioFiles(processedClips, outputFilename);

        console.log('\nDone!');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Check if ffmpeg is installed
exec('ffmpeg -version', (error) => {
    if (error) {
        console.error('Error: ffmpeg is not installed or not in PATH.');
        console.error('Please install ffmpeg to use this tool: https://ffmpeg.org/download.html');
        process.exit(1);
    } else {
        // Start the application
        main();
    }
});