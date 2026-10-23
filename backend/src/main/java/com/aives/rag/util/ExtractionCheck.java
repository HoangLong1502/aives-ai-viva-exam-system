package com.aives.rag.util;

import com.aives.rag.util.PageSplit.Page;
import java.util.List;
import java.util.Optional;

/** Decides whether extracted text is usable, so scanned PDFs fail with a clear reason instead of silently. */
public final class ExtractionCheck {

    /** Fewer extracted characters per page than this means the PDF is almost certainly scanned images. */
    static final int MIN_CHARS_PER_PAGE = 80;
    /** A PDF where fewer than this share of pages has text is treated as (mostly) scanned. */
    static final double MIN_TEXT_PAGE_SHARE = 0.5;

    private ExtractionCheck() {
    }

    public static Optional<String> problem(String extension, Integer pageCount, List<Page> pages) {
        int characters = pages.stream().mapToInt(page -> page.text().strip().length()).sum();
        if (characters == 0) {
            return Optional.of("pdf".equals(extension)
                    ? "This PDF has no text layer (it looks scanned). Run OCR on it, or export it as a text PDF, then upload again."
                    : "The file did not contain any text.");
        }
        if (!"pdf".equals(extension) || pageCount == null || pageCount <= 0) {
            return Optional.empty();
        }
        boolean sparse = (double) characters / pageCount < MIN_CHARS_PER_PAGE;
        // Only trust the per-page split when Tika produced one; otherwise all text sits in a single block.
        boolean fewTextPages = pages.size() > 1 && (double) pages.size() / pageCount < MIN_TEXT_PAGE_SHARE;
        if (sparse || fewTextPages) {
            return Optional.of("Text was found on only " + pages.size() + " of " + pageCount + " pages ("
                    + characters + " characters), so this PDF looks scanned. Run OCR on it, then upload again.");
        }
        return Optional.empty();
    }
}
