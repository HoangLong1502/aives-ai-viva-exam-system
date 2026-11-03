package com.aives.rag.util;

import com.aives.rag.util.PageSplit.Page;
import java.util.ArrayList;
import java.util.List;

public final class TextChunker {

    public static final int TARGET = 900;
    public static final int OVERLAP = 120;

    private TextChunker() {
    }

    public record Chunk(String label, String text, int index) {
    }

    public static List<Chunk> chunk(List<Page> pages) {
        List<Chunk> chunks = new ArrayList<>();
        int index = 0;
        for (Page page : pages) {
            String text = page.text() == null ? "" : page.text().trim();
            if (text.isBlank()) {
                continue;
            }
            int start = 0;
            while (start < text.length()) {
                int end = Math.min(text.length(), start + TARGET);
                if (end < text.length()) {
                    int breakAt = text.lastIndexOf(' ', end);
                    if (breakAt > start + TARGET / 2) {
                        end = breakAt;
                    }
                }
                String slice = text.substring(start, end).trim();
                if (!slice.isBlank()) {
                    chunks.add(new Chunk(page.label(), slice, index++));
                }
                if (end >= text.length()) {
                    break;
                }
                start = Math.max(end - OVERLAP, start + 1);
            }
        }
        return chunks;
    }
}
