# yt-audio

A command-line tool to download and merge audio clips from YouTube videos.

## Features

- Extract audio from specific time ranges in YouTube videos
- Merge multiple audio clips into a single file
- Interactive mode for easy input
- Batch processing through a text file

## Installation

```bash
npm install -g yt-audio
```

This installs the tool globally, making it available as a command from any directory.

### Prerequisites

- **Node.js**: [nodejs.org](https://nodejs.org/)
- **FFmpeg**: Required for audio processing

#### Installing FFmpeg

**Windows:**
1. Download from [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Add to your PATH environment variable

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update && sudo apt install ffmpeg
```

## Quick Start

### Interactive Mode

```bash
yt-audio
```

Follow the prompts and enter each YouTube URL with start and end times:
```
> https://www.youtube.com/watch?v=dQw4w9WgXcQ 00:30 01:45
```

Press Enter on an empty line when done.

### Using a File

Create a text file with URLs and timestamps:
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ 00:30 01:45
https://www.youtube.com/watch?v=9bZkp7q19f0 01:15 02:30
```

Then run:
```bash
yt-audio --input playlist.txt --output mix.mp3
```

## Command Options

```
yt-audio [options]
```

Options:
- `-i, --input <path>` - Path to input file with YouTube URLs and timestamps
- `-o, --output <filename>` - Output filename (default: merged_audio.mp3)
- `-f, --format <format>` - Output audio format (default: mp3)
- `-b, --bitrate <bitrate>` - Output audio bitrate (default: 128k)

## Examples

Extract clips from multiple videos and save as high-quality audio:
```bash
yt-audio -i favorites.txt -o compilation.mp3 -b 320k
```

## For Non-Developers

If you're new to command-line tools:

1. Install Node.js from [nodejs.org](https://nodejs.org/)
2. Install FFmpeg (see instructions above)
3. Open a terminal or command prompt
4. Run: `npm install -g yt-audio`
5. Run: `yt-audio` and follow the instructions

## Time Formats

Supported formats:
- `HH:MM:SS` (hours:minutes:seconds)
- `MM:SS` (minutes:seconds)
- `SS` (seconds)

## License

MIT

## Legal Notice

This tool is for personal use only. Please respect copyright and only download content you have permission to use.
