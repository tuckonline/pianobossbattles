#!/usr/bin/env python3
"""Learn Piano Fast: one-shot local export. No server, uploads or source changes.

Requires Python 3.10+ and FFmpeg with libx264, AAC and drawtext.
Run this downloaded file, or: python export-short.py --source recording.mp4
Optional: --ffmpeg /path/to/ffmpeg --output /path/to/new-short.mp4
"""
import argparse
import base64
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap

EMBEDDED_PLAN = '__PLAN_BASE64__'

def probe(ffmpeg, source):
    process = subprocess.run([ffmpeg, '-hide_banner', '-i', str(source)], capture_output=True, text=True, encoding='utf-8', errors='replace')
    text = process.stderr
    video = next((line for line in text.splitlines() if 'Video:' in line and 'attached pic' not in line), '')
    size = re.search(r'\b(\d{2,5})x(\d{2,5})\b', video)
    fps = re.search(r'([\d.]+) fps', video)
    duration = re.search(r'Duration: (\d+):(\d+):([\d.]+)', text)
    if not size or not duration:
        raise ValueError('FFmpeg could not read this recording: ' + text[-1500:])
    return {'width': int(size[1]), 'height': int(size[2]), 'fps': float(fps[1]) if fps else 30,
            'duration': int(duration[1])*3600+int(duration[2])*60+float(duration[3]), 'audio': 'Audio:' in text}

def validate(plan, source, output, info):
    if plan.get('version') != 1:
        raise ValueError('Unsupported export plan version.')
    if source.resolve() == output.resolve() or output.exists():
        raise ValueError('Choose a new output filename. Existing files are never overwritten.')
    start, end = plan['start'], plan['end']
    if not all(isinstance(n, (int, float)) and math.isfinite(n) for n in [start, end]):
        raise ValueError('Invalid trim points.')
    if not 0 <= start < end <= info['duration'] + .05:
        raise ValueError('Trim points are outside the source recording.')
    if start > plan['evidence']['climax'] or end < plan['evidence']['payoff']:
        raise ValueError('The trim would omit the highlight or cinematic payoff.')
    if info['height'] / info['width'] < 1.7:
        raise ValueError('Use the vertical OBS recording; horizontal footage is not cropped.')
    expected = plan.get('source', {})
    if expected.get('size') is not None and source.stat().st_size != expected['size']:
        raise ValueError('This is not the recording linked in Shorts Studio (file size differs).')
    if expected.get('duration') and abs(info['duration'] - expected['duration']) > .2:
        raise ValueError('The recording duration differs from the aligned source.')
    if len(plan.get('hook', '')) > 100 or len(plan.get('context', '')) > 350:
        raise ValueError('Caption is too long.')

def export(plan, source, output, ffmpeg):
    info = probe(ffmpeg, source)
    validate(plan, source, output, info)
    output.parent.mkdir(parents=True, exist_ok=True)
    # All file paths are separate subprocess arguments. Caption text is read
    # literally from UTF-8 files; it never becomes shell/filter code.
    with tempfile.TemporaryDirectory(prefix='lpf-short-', dir=output.parent) as folder:
        work = Path(folder)
        filters = ['scale=1080:1920:force_original_aspect_ratio=decrease', 'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0b172a', 'setsar=1']
        font = next((p for p in [Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts/arialbd.ttf', Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'), Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')] if p.exists()), None)
        if font: shutil.copyfile(font, work/'font.ttf')
        font_filter = 'fontfile=font.ttf:' if font else 'font=Sans:'
        if plan.get('hookVisible'):
            lines = textwrap.wrap(plan['hook'].replace('\n',' '), width=34)[:3]
            (work/'hook.txt').write_text('\n'.join(lines), encoding='utf-8')
            filters += ["drawbox=x=60:y=28:w=850:h=125:color=0x0b172a:t=fill:enable='lt(t,3)'",
                        f"drawtext={font_filter}textfile=hook.txt:expansion=none:fontcolor=white:fontsize=38:line_spacing=2:x=80:y=38:enable='lt(t,3)'"]
        if plan.get('contextVisible'):
            (work/'context.txt').write_text(textwrap.shorten(plan['context'], width=65, placeholder='…'), encoding='utf-8')
            filters += ["drawbox=x=60:y=154:w=850:h=32:color=0x0b172a:t=fill:enable='lt(t,5)'",
                        f"drawtext={font_filter}textfile=context.txt:expansion=none:fontcolor=0xaed9ea:fontsize=22:x=80:y=158:enable='lt(t,5)'"]
        destination = work/'encoded.mp4'
        args = [ffmpeg, '-hide_banner', '-nostdin', '-ss', str(plan['start']), '-i', str(source.resolve()), '-t', str(plan['end']-plan['start']),
                '-map', '0:v:0', '-map', '0:a:0?', '-vf', ','.join(filters), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
                '-pix_fmt', 'yuv420p', '-r', str(min(60, max(1, info['fps']))), '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', str(destination)]
        result = subprocess.run(args, cwd=work, capture_output=True, text=True, encoding='utf-8', errors='replace')
        if result.returncode:
            raise RuntimeError('Export failed. Source recording is unchanged. Check FFmpeg includes libx264/drawtext.\n' + result.stderr[-2400:])
        actual = probe(ffmpeg, destination)
        if (actual['width'],actual['height']) != (1080,1920) or (info['audio'] and not actual['audio']):
            raise RuntimeError('Export validation failed: dimensions or audio missing. Source is unchanged.')
        # Exclusive create prevents replacing a file created while encoding.
        try:
            with output.open('xb') as out, destination.open('rb') as src: shutil.copyfileobj(src,out)
        except FileExistsError:
            raise ValueError('Output already exists. Choose a new name.')
        report = {'version':1,'recordingId':plan['recordingId'],'clipId':plan['clipId'],'output':str(output),'source':str(source),
                  'start':plan['start'],'end':plan['end'],'media':actual,'audio':'Original first audio track; AAC encoding, no gain, normalization or remix',
                  'evidence':plan['evidence']}
        output.with_suffix('.export.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        return report

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source');parser.add_argument('--output');parser.add_argument('--ffmpeg');parser.add_argument('--plan')
    args=parser.parse_args()
    if args.plan: plan=json.loads(Path(args.plan).read_text(encoding='utf-8'))
    elif EMBEDDED_PLAN.startswith('__'): raise ValueError('Download an approved export kit from Shorts Studio first.')
    else: plan=json.loads(base64.b64decode(EMBEDDED_PLAN))
    executable=args.ffmpeg or shutil.which('ffmpeg')
    if not executable:
        raise ValueError('FFmpeg was not found. Install it from https://ffmpeg.org/download.html, add its bin folder to PATH, or pass --ffmpeg C:/path/ffmpeg.exe. No software is installed automatically.')
    source=args.source
    if not source:
        from tkinter import Tk,filedialog
        root=Tk();root.withdraw();source=filedialog.askopenfilename(title='Select the original OBS recording');root.destroy()
    if not source: raise ValueError('No recording selected; nothing was changed.')
    path=Path(source)
    output=Path(args.output) if args.output else path.with_name(path.stem+'-short-'+re.sub(r'[^a-zA-Z0-9]','',plan['clipId'])[-16:]+'.mp4')
    report=export(plan,path,output,str(Path(executable).resolve()))
    print('Export complete:',report['output']);print('1080 x 1920 MP4. Review the exported video and piano audio before sharing.')

if __name__=='__main__':
    try: main()
    except Exception as error:
        print('Learn Piano Fast export error:',error,file=sys.stderr)
        sys.exit(1)
