package com.erdalguda.tailor.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class BlogPostResponse {

    private Long id;
    private String slug;
    private String title;
    private String category;
    private String summary;
    private String body;
    private String author;
    private String readTime;
    private LocalDateTime publishedAt;
}
