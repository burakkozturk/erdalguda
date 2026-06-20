package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.BlogPostResponse;
import com.erdalguda.tailor.entity.BlogPost;
import com.erdalguda.tailor.exception.ResourceNotFoundException;
import com.erdalguda.tailor.repository.BlogPostRepository;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BlogPostService {

    private final BlogPostRepository blogPostRepository;

    public BlogPostService(BlogPostRepository blogPostRepository) {
        this.blogPostRepository = blogPostRepository;
    }

    @Transactional(readOnly = true)
    public List<BlogPostResponse> getAllPosts() {
        return blogPostRepository.findAll().stream()
            .sorted(Comparator.comparing(BlogPost::getPublishedAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public BlogPostResponse getPostBySlug(String slug) {
        BlogPost post = blogPostRepository.findBySlug(slug)
            .orElseThrow(() -> new ResourceNotFoundException("Yazı bulunamadı: " + slug));
        return toResponse(post);
    }

    private BlogPostResponse toResponse(BlogPost post) {
        return BlogPostResponse.builder()
            .id(post.getId())
            .slug(post.getSlug())
            .title(post.getTitle())
            .category(post.getCategory())
            .summary(post.getSummary())
            .body(post.getBody())
            .author(post.getAuthor())
            .readTime(post.getReadTime())
            .publishedAt(post.getPublishedAt())
            .build();
    }
}
