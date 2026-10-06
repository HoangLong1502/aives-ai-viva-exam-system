package com.aives.rag;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.aives.web.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class GeneratedQuestionParserTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void parsesExpectedAnswerAndKeyPoints() {
        String content = """
                {
                  "questions": [
                    {
                      "prompt": "What is a primary key in a database table?",
                      "source": "db.docx, page 1",
                      "expectedAnswer": "A primary key uniquely identifies each row in a table.",
                      "keyPoints": "unique identifier; one per table; no nulls"
                    }
                  ]
                }
                """;
        List<GeneratedQuestionParser.Draft> drafts = GeneratedQuestionParser.parse(content, 1, mapper);
        assertEquals(1, drafts.size());
        assertEquals("What is a primary key in a database table?", drafts.getFirst().prompt());
        assertEquals("A primary key uniquely identifies each row in a table.", drafts.getFirst().expectedAnswer());
        assertEquals("unique identifier; one per table; no nulls", drafts.getFirst().keyPoints());
    }

    @Test
    void rejectsMissingAnswer() {
        String content = """
                {
                  "questions": [
                    {
                      "prompt": "What is a primary key in a database table?",
                      "source": "db.docx, page 1"
                    }
                  ]
                }
                """;
        assertThrows(ApiException.class, () -> GeneratedQuestionParser.parse(content, 1, mapper));
    }
}
