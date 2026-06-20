package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.BlogPostResponse;
import com.erdalguda.tailor.service.BlogPostService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/blog-posts")
public class BlogPostController {

    private final BlogPostService blogPostService;

    public BlogPostController(BlogPostService blogPostService) {
        this.blogPostService = blogPostService;
    }

    @GetMapping
    public ResponseEntity<List<BlogPostResponse>> list() {
        return ResponseEntity.ok(blogPostService.getAllPosts());
    }

    @GetMapping("/{slug}")
    public ResponseEntity<BlogPostResponse> getBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(blogPostService.getPostBySlug(slug));
    }
}
