package com.aives.rag.util;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class PageSplit {

    private static final Pattern BLOCK = Pattern.compile(
            "(?is)<div[^>]*class=\"[^\"]*\\b(page|slide)\\b[^\"]*\"[^>]*>(.*?)</div>"
    );

    private PageSplit() {
    }

    public record Page(String label, String text) {
    }

    public static List<Page> fromTikaXml(String xml) {
        Matcher matcher = BLOCK.matcher(xml);
        List<Page> pages = new ArrayList<>();
        while (matcher.find()) {
            String kind = matcher.group(1).equalsIgnoreCase("slide") ? "slide" : "page";
            String text = plain(matcher.group(2));
            if (!text.isBlank()) {
                pages.add(new Page(kind + " " + (pages.size() + 1), text));
            }
        }
        if (!pages.isEmpty()) {
            return pages;
        }
        String text = plain(xml);
        if (text.isBlank()) {
            return List.of();
        }
        String[] parts = text.split("\\f");
        if (parts.length > 1) {
            for (String part : parts) {
                String page = part.trim();
                if (!page.isBlank()) {
                    pages.add(new Page("page " + (pages.size() + 1), page));
                }
            }
            return pages;
        }
        return List.of(new Page("page 1", text.trim()));
    }

    static String plain(String xml) {
        return xml.replaceAll("(?is)<script.*?>.*?</script>", " ")
                .replaceAll("(?is)<style.*?>.*?</style>", " ")
                .replaceAll("(?is)<br\\s*/?>", "\n")
                .replaceAll("(?is)</p>", "\n")
                .replaceAll("(?is)<[^>]+>", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replaceAll("[\\t\\x0B ]+", " ")
                .replaceAll(" *\\n *", "\n")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
    }
}
