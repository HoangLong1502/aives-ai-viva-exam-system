package com.aives.rag.util;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aives.rag.util.PageSplit.Page;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class ExtractionCheckTest {

    private static final String PARAGRAPH = "A primary key uniquely identifies each row in a relational table. ".repeat(4);

    @Test
    void pdfWithoutTextIsReportedAsScanned() {
        assertTrue(ExtractionCheck.problem("pdf", 12, List.of()).orElseThrow().contains("scanned"));
    }

    @Test
    void pdfWithTextOnFewPagesIsReportedAsScanned() {
        List<Page> pages = List.of(new Page("page 1", PARAGRAPH), new Page("page 2", PARAGRAPH));
        assertTrue(ExtractionCheck.problem("pdf", 20, pages).orElseThrow().contains("2 of 20"));
    }

    @Test
    void pdfWithOnlyPageNumbersIsReportedAsScanned() {
        List<Page> pages = IntStream.rangeClosed(1, 10).mapToObj(i -> new Page("page " + i, String.valueOf(i))).toList();
        assertTrue(ExtractionCheck.problem("pdf", 10, pages).isPresent());
    }

    @Test
    void textPdfPasses() {
        List<Page> pages = IntStream.rangeClosed(1, 5).mapToObj(i -> new Page("page " + i, PARAGRAPH)).toList();
        assertTrue(ExtractionCheck.problem("pdf", 5, pages).isEmpty());
    }

    @Test
    void unsplitPdfTextIsJudgedByDensityOnly() {
        assertTrue(ExtractionCheck.problem("pdf", 3, List.of(new Page("page 1", PARAGRAPH.repeat(3)))).isEmpty());
    }

    @Test
    void slidesWithLittleTextAreAccepted() {
        assertTrue(ExtractionCheck.problem("pptx", null, List.of(new Page("slide 1", "Keys"))).isEmpty());
    }

    @Test
    void emptyDocxIsRejected() {
        assertTrue(ExtractionCheck.problem("docx", null, List.of()).isPresent());
    }
}
