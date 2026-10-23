package com.aives.rag.service;

import com.aives.rag.parser.GeneratedQuestionParser;
import com.aives.rag.util.PageSplit;
import com.aives.rag.util.TextChunker;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aives.rag.util.PageSplit.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class RagPipelineTest {

    @Test
    void splitsTikaPagesAndSlides() {
        String xml = """
                <html><body>
                <div class="page"><p>First page</p></div>
                <div class="slide"><p>First slide</p></div>
                </body></html>
                """;

        List<Page> pages = PageSplit.fromTikaXml(xml);

        assertEquals(2, pages.size());
        assertEquals("page 1", pages.get(0).label());
        assertEquals("First page", pages.get(0).text());
        assertEquals("slide 2", pages.get(1).label());
    }

    @Test
    void chunksALongPageAndKeepsTheLabel() {
        String text = "word ".repeat(400);

        List<TextChunker.Chunk> chunks = TextChunker.chunk(List.of(new Page("page 1", text)));

        assertTrue(chunks.size() > 1);
        assertEquals("page 1", chunks.getFirst().label());
        assertTrue(chunks.getFirst().text().length() <= TextChunker.TARGET);
    }

    @Test
    void readsFencedQuestionJson() {
        String content = """
                ```json
                {"questions":[{"prompt":"Explain the claim with an example.","source":"lecture.pdf, page 2","expectedAnswer":"The claim holds because the lecture proves it.","keyPoints":"claim; proof; example"}]}
                ```
                """;

        List<GeneratedQuestionParser.Draft> drafts = GeneratedQuestionParser.parse(content, 1, new ObjectMapper());

        assertEquals("lecture.pdf, page 2", drafts.getFirst().source());
    }

    @Test
    void rejectsAQuestionWithoutAnExpectedAnswer() {
        String content = """
                {"questions":[{"prompt":"Explain the claim with an example.","source":"lecture.pdf, page 2"}]}
                """;

        assertThrows(
                com.aives.web.ApiException.class,
                () -> GeneratedQuestionParser.parse(content, 1, new ObjectMapper())
        );
    }
}
