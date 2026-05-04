#!/usr/bin/env node
// Convert a markdown file to a .docx file using the docx package.
// Usage: node scripts/md-to-docx.mjs <input.md> [output.docx]
// Supports: # / ## / ### headings, - / * bullets, **bold**, *italic*,
// paragraphs, blank lines, --- horizontal rules, > blockquotes.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

function parseInline(line) {
  const segments = [];
  let i = 0;
  let buffer = '';
  let bold = false;
  let italic = false;

  function flush() {
    if (buffer) {
      segments.push({ text: buffer, bold, italic });
      buffer = '';
    }
  }

  while (i < line.length) {
    if (line[i] === '*' && line[i + 1] === '*') {
      flush();
      bold = !bold;
      i += 2;
    } else if (line[i] === '*' && (i === 0 || line[i - 1] !== '*') && line[i + 1] !== '*') {
      flush();
      italic = !italic;
      i += 1;
    } else {
      buffer += line[i];
      i += 1;
    }
  }
  flush();
  return segments.length ? segments : [{ text: '' }];
}

function inlineToRuns(line, baseStyle = {}) {
  return parseInline(line).map(
    (seg) =>
      new TextRun({
        text: seg.text,
        bold: seg.bold,
        italics: seg.italic,
        ...baseStyle,
      })
  );
}

function markdownToParagraphs(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const children = [];

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === '') {
      children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
      continue;
    }

    if (line.trim() === '---' || line.trim() === '***') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '________________________________________________',
              color: 'BBBBBB',
            }),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { before: 100, after: 100 },
        })
      );
      continue;
    }

    if (line.startsWith('# ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: inlineToRuns(line.slice(2)),
          spacing: { before: 280, after: 140 },
        })
      );
      continue;
    }

    if (line.startsWith('## ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: inlineToRuns(line.slice(3)),
          spacing: { before: 240, after: 100 },
        })
      );
      continue;
    }

    if (line.startsWith('### ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: inlineToRuns(line.slice(4)),
          spacing: { before: 180, after: 80 },
        })
      );
      continue;
    }

    if (line.startsWith('> ')) {
      children.push(
        new Paragraph({
          children: inlineToRuns(line.slice(2), { italics: true, color: '4F5B6C' }),
          indent: { left: 360 },
          spacing: { before: 80, after: 80 },
        })
      );
      continue;
    }

    if (line.match(/^\s*[-*]\s+/)) {
      const content = line.replace(/^\s*[-*]\s+/, '');
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: inlineToRuns(content),
          spacing: { after: 60 },
        })
      );
      continue;
    }

    if (line.match(/^\s*\d+\.\s+/)) {
      const content = line.replace(/^\s*\d+\.\s+/, '');
      children.push(
        new Paragraph({
          numbering: { reference: 'numbered', level: 0 },
          children: inlineToRuns(content),
          spacing: { after: 60 },
        })
      );
      continue;
    }

    children.push(
      new Paragraph({
        children: inlineToRuns(line),
        spacing: { after: 100 },
      })
    );
  }

  return children;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/md-to-docx.mjs <input.md> [output.docx]');
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1] || join(
    dirname(inputPath),
    basename(inputPath).replace(/\.md$/i, '.docx')
  );

  const markdown = readFileSync(inputPath, 'utf8');
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : basename(inputPath, '.md');

  const children = markdownToParagraphs(markdown);

  const doc = new Document({
    title,
    creator: 'Aqualitcs',
    description: 'AI-generated meeting briefing',
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 }, // 11pt
        },
      },
    },
    sections: [{ properties: {}, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(outputPath, buffer);
  console.log(`Wrote ${outputPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
