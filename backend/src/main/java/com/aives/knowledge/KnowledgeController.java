package com.aives.knowledge;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/knowledge")
public class KnowledgeController {

    private final KnowledgeService knowledge;

    public KnowledgeController(KnowledgeService knowledge) {
        this.knowledge = knowledge;
    }

    @PostMapping
    public StoredKnowledge create(@Valid @RequestBody CreateKnowledgeRequest request) {
        return knowledge.create(request.courseId(), request.title(), request.content());
    }

    @GetMapping
    public Object listOrSearch(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "5") int limit
    ) {
        if (q == null) {
            return knowledge.list();
        }
        return knowledge.search(q, limit);
    }

    public record CreateKnowledgeRequest(
            @NotNull UUID courseId,
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 8000) String content
    ) {
    }
}
