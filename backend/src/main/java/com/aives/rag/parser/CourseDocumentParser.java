package com.aives.rag.parser;

import com.aives.rag.util.PageSplit;
import com.aives.rag.util.PageSplit.Page;
import java.io.InputStream;
import java.util.List;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.PagedText;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.sax.ToXMLContentHandler;
import org.springframework.stereotype.Component;

@Component
public class CourseDocumentParser {

    public ParsedDocument parse(InputStream input) throws Exception {
        AutoDetectParser parser = new AutoDetectParser();
        ToXMLContentHandler handler = new ToXMLContentHandler();
        Metadata metadata = new Metadata();
        parser.parse(input, handler, metadata, new ParseContext());
        Integer pageCount = metadata.getInt(PagedText.N_PAGES);
        return new ParsedDocument(PageSplit.fromTikaXml(handler.toString()), pageCount);
    }

    /** @param pageCount pages reported by the file format (PDF), or null when unknown */
    public record ParsedDocument(List<Page> pages, Integer pageCount) {
    }
}
