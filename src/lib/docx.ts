import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

function parseInline(line: string): InlineSegment[] {
  // Handles **bold** and *italic* markers (simple, non-nested).
  const segments: InlineSegment[] = [];
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
    } else if (line[i] === '*') {
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

function inlineToRuns(line: string): TextRun[] {
  return parseInline(line).map(
    (seg) => new TextRun({ text: seg.text, bold: seg.bold, italics: seg.italic })
  );
}

/**
 * Convert a markdown string to a docx Blob suitable for download.
 * Supports: # / ## / ### headings, - / * bullets, **bold**, *italic*,
 * paragraphs, blank lines, --- horizontal rules.
 */
export async function markdownToDocxBlob(
  markdown: string,
  title = 'Briefing'
): Promise<Blob> {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const children: Paragraph[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === '') {
      children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
      continue;
    }

    if (line.trim() === '---' || line.trim() === '***') {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '____________________________', color: '888888' })],
          alignment: AlignmentType.LEFT,
        })
      );
      continue;
    }

    if (line.startsWith('# ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: inlineToRuns(line.slice(2)),
          spacing: { before: 200, after: 120 },
        })
      );
      continue;
    }

    if (line.startsWith('## ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: inlineToRuns(line.slice(3)),
          spacing: { before: 240, after: 80 },
        })
      );
      continue;
    }

    if (line.startsWith('### ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: inlineToRuns(line.slice(4)),
          spacing: { before: 180, after: 60 },
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

  const doc = new Document({
    title,
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
