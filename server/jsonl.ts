/** Reads a JSONL skipping broken lines (the file may be mid-write). */
export async function readJsonl(file: string): Promise<any[]> {
    const text = await Bun.file(file).text();
    const lines: any[] = [];
    for (const line of text.split('\n')) {
        if (!line.trim()) {
            continue;
        }
        try {
            lines.push(JSON.parse(line));
        } catch {
            // Partial last line while the tool is still writing.
        }
    }
    return lines;
}
