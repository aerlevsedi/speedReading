-- Migration: Seed remaining 7 exercises (4 types × 2 datasets - 1 already exists)
-- Adds Animated Pacer dataset_2, Smart Questions (2), Focus Sprint (2), Speed Scan (2)

-- Animated Pacer dataset_2 (React State Management)
INSERT INTO exercises (
  id,
  exercise_type,
  dataset_id,
  title,
  description,
  content,
  config,
  difficulty,
  estimated_duration_seconds
) VALUES (
  'a0000000-0000-0000-0000-000000000002'::UUID,
  'animated_pacer',
  'dataset_2',
  'React State Management Patterns',
  'Understand modern React state management approaches and when to use each pattern in your applications.',
  'State management is a fundamental concept in React applications that determines how data flows through your components. React provides several built-in mechanisms for managing state, each suited for different use cases and application scales.

The useState hook is the simplest form of state management, perfect for component-local state that doesn''t need to be shared. When a component needs to track a single value like an input field or a toggle, useState provides a clean API without unnecessary complexity. However, as components grow and state becomes more interconnected, useState can lead to prop drilling where data must be passed through multiple component layers.

For more complex scenarios, the useReducer hook offers a structured approach inspired by Redux. It works well when state updates follow predictable patterns or when multiple actions can modify the same state. A reducer function centralizes state logic, making it easier to test and reason about. This pattern shines in forms with validation, multi-step wizards, or any component where state transitions need to be explicit and traceable.

Context API solves the prop drilling problem by allowing state to be shared across component trees without manual passing. It''s ideal for global concerns like theme, authentication, or language preferences. However, Context comes with a performance caveat: all consumers re-render when context value changes, regardless of which part of the value they actually use. Strategic context splitting and memoization become essential in larger applications.

Modern state management libraries like Zustand and Jotai provide alternatives that address Context''s limitations while keeping the API simple. These libraries offer fine-grained reactivity, better performance characteristics, and built-in devtools. The key is choosing the right tool for your application''s scale: useState for simple cases, useReducer for complex local state, Context for shared global state, and dedicated libraries when performance and scalability matter most.',
  '{"target_wpm": 250, "pacer_speed": "adaptive", "highlight_color": "#3b82f6"}',
  'intermediate',
  120
);

-- Smart Questions dataset_1 (API Design Patterns)
INSERT INTO exercises (
  id,
  exercise_type,
  dataset_id,
  title,
  description,
  content,
  config,
  difficulty,
  estimated_duration_seconds
) VALUES (
  'a0000000-0000-0000-0000-000000000011'::UUID,
  'smart_questions',
  'dataset_1',
  'RESTful API Design Principles',
  'Learn the fundamental principles of REST API design and best practices for building maintainable web services.',
  'REST (Representational State Transfer) is an architectural style for designing networked applications that has become the dominant approach for building web APIs. Understanding REST principles helps developers create APIs that are intuitive, scalable, and easy to maintain.

The foundation of REST is resource-oriented design. Every entity in your system—users, posts, comments—should be represented as a resource with a unique URL. For example, /api/users/123 identifies a specific user, while /api/users represents the collection. This hierarchical structure makes APIs predictable and discoverable. Resources should be nouns, not verbs: use GET /api/posts instead of GET /api/getPosts.

HTTP methods provide the verbs that operate on resources. GET retrieves data without side effects, POST creates new resources, PUT replaces entire resources, PATCH updates partial data, and DELETE removes resources. Proper method usage communicates intent clearly and enables HTTP caching and safety guarantees. A well-designed API respects these semantics: GET requests should never modify data, and PUT should be idempotent.

Status codes are crucial for communicating outcomes. 200 means success, 201 signals resource creation, 204 indicates success with no content, 400 flags client errors, 404 means not found, and 500 represents server failures. Consistent status code usage lets clients handle errors generically without parsing response bodies. Include meaningful error messages in the response body to help debugging.

Versioning strategies prevent breaking changes from disrupting existing clients. URL versioning (/api/v1/users) is explicit and easy to route, while header-based versioning (Accept: application/vnd.api+json; version=1) keeps URLs clean but adds complexity. Whatever strategy you choose, version early and maintain backward compatibility within major versions. Deprecation warnings and migration guides help clients transition smoothly to newer versions.',
  '{"questions_count": 5, "time_per_question": 30}',
  'intermediate',
  180
);

-- Smart Questions dataset_2 (API Design Patterns - same content, different questions via config)
INSERT INTO exercises (
  id,
  exercise_type,
  dataset_id,
  title,
  description,
  content,
  config,
  difficulty,
  estimated_duration_seconds
) VALUES (
  'a0000000-0000-0000-0000-000000000012'::UUID,
  'smart_questions',
  'dataset_2',
  'RESTful API Design Principles',
  'Learn the fundamental principles of REST API design and best practices for building maintainable web services.',
  'REST (Representational State Transfer) is an architectural style for designing networked applications that has become the dominant approach for building web APIs. Understanding REST principles helps developers create APIs that are intuitive, scalable, and easy to maintain.

The foundation of REST is resource-oriented design. Every entity in your system—users, posts, comments—should be represented as a resource with a unique URL. For example, /api/users/123 identifies a specific user, while /api/users represents the collection. This hierarchical structure makes APIs predictable and discoverable. Resources should be nouns, not verbs: use GET /api/posts instead of GET /api/getPosts.

HTTP methods provide the verbs that operate on resources. GET retrieves data without side effects, POST creates new resources, PUT replaces entire resources, PATCH updates partial data, and DELETE removes resources. Proper method usage communicates intent clearly and enables HTTP caching and safety guarantees. A well-designed API respects these semantics: GET requests should never modify data, and PUT should be idempotent.

Status codes are crucial for communicating outcomes. 200 means success, 201 signals resource creation, 204 indicates success with no content, 400 flags client errors, 404 means not found, and 500 represents server failures. Consistent status code usage lets clients handle errors generically without parsing response bodies. Include meaningful error messages in the response body to help debugging.

Versioning strategies prevent breaking changes from disrupting existing clients. URL versioning (/api/v1/users) is explicit and easy to route, while header-based versioning (Accept: application/vnd.api+json; version=1) keeps URLs clean but adds complexity. Whatever strategy you choose, version early and maintain backward compatibility within major versions. Deprecation warnings and migration guides help clients transition smoothly to newer versions.',
  '{"questions_count": 5, "time_per_question": 45}',
  'advanced',
  180
);

-- Focus Sprint dataset_1 (CSS Layout Techniques)
INSERT INTO exercises (
  id,
  exercise_type,
  dataset_id,
  title,
  description,
  content,
  config,
  difficulty,
  estimated_duration_seconds
) VALUES (
  'a0000000-0000-0000-0000-000000000021'::UUID,
  'focus_sprint',
  'dataset_1',
  'Modern CSS Layout Fundamentals',
  'Master Flexbox and Grid layout systems to build responsive, maintainable web interfaces without layout hacks.',
  'CSS layout has evolved dramatically from table-based layouts and float hacks to modern layout systems that make responsive design intuitive and maintainable. Flexbox and Grid are the two fundamental layout tools every developer should master.

Flexbox excels at one-dimensional layouts where items flow in a single direction, either horizontally or vertically. It automatically distributes space, handles alignment, and manages item order without manual calculations. Common use cases include navigation bars, button groups, card layouts, and form rows. The flex container controls direction, wrapping, and spacing, while flex items can grow, shrink, or maintain fixed sizes. Understanding flex-basis, flex-grow, and flex-shrink unlocks Flexbox''s full power.

CSS Grid tackles two-dimensional layouts where content needs to align both horizontally and vertically. Grid defines explicit rows and columns, creating a structure where items can span multiple tracks and overlap if needed. Photo galleries, dashboard layouts, and magazine-style designs become trivial with Grid. The fr unit (fraction) makes responsive columns elegant: grid-template-columns: 1fr 2fr 1fr creates a layout where the middle column takes twice the space of the sidebars.

Both systems support alignment properties that work consistently: justify-content and align-items control item positioning within containers. This consistency eliminates the confusion of different alignment approaches for different layout methods. Gap properties replace margin hacks for spacing, making layouts cleaner and more maintainable.

Responsive design combines Flexbox, Grid, and media queries to create layouts that adapt to screen sizes. Mobile-first approaches start with simple vertical layouts (flex-direction: column) and enhance to complex grids on larger screens. Container queries, a newer addition, enable components to respond to their container size rather than viewport size, enabling true component reusability across different layouts.',
  '{"target_wpm": 400, "pressure_threshold": 60, "countdown_seconds": 90}',
  'beginner',
  90
);

-- Focus Sprint dataset_2 (CSS Layout Techniques - same content, different config)
INSERT INTO exercises (
  id,
  exercise_type,
  dataset_id,
  title,
  description,
  content,
  config,
  difficulty,
  estimated_duration_seconds
) VALUES (
  'a0000000-0000-0000-0000-000000000022'::UUID,
  'focus_sprint',
  'dataset_2',
  'Modern CSS Layout Fundamentals',
  'Master Flexbox and Grid layout systems to build responsive, maintainable web interfaces without layout hacks.',
  'CSS layout has evolved dramatically from table-based layouts and float hacks to modern layout systems that make responsive design intuitive and maintainable. Flexbox and Grid are the two fundamental layout tools every developer should master.

Flexbox excels at one-dimensional layouts where items flow in a single direction, either horizontally or vertically. It automatically distributes space, handles alignment, and manages item order without manual calculations. Common use cases include navigation bars, button groups, card layouts, and form rows. The flex container controls direction, wrapping, and spacing, while flex items can grow, shrink, or maintain fixed sizes. Understanding flex-basis, flex-grow, and flex-shrink unlocks Flexbox''s full power.

CSS Grid tackles two-dimensional layouts where content needs to align both horizontally and vertically. Grid defines explicit rows and columns, creating a structure where items can span multiple tracks and overlap if needed. Photo galleries, dashboard layouts, and magazine-style designs become trivial with Grid. The fr unit (fraction) makes responsive columns elegant: grid-template-columns: 1fr 2fr 1fr creates a layout where the middle column takes twice the space of the sidebars.

Both systems support alignment properties that work consistently: justify-content and align-items control item positioning within containers. This consistency eliminates the confusion of different alignment approaches for different layout methods. Gap properties replace margin hacks for spacing, making layouts cleaner and more maintainable.

Responsive design combines Flexbox, Grid, and media queries to create layouts that adapt to screen sizes. Mobile-first approaches start with simple vertical layouts (flex-direction: column) and enhance to complex grids on larger screens. Container queries, a newer addition, enable components to respond to their container size rather than viewport size, enabling true component reusability across different layouts.',
  '{"target_wpm": 450, "pressure_threshold": 50, "countdown_seconds": 120}',
  'intermediate',
  120
);

-- Speed Scan dataset_1 (Web Performance Optimization)
INSERT INTO exercises (
  id,
  exercise_type,
  dataset_id,
  title,
  description,
  content,
  config,
  difficulty,
  estimated_duration_seconds
) VALUES (
  'a0000000-0000-0000-0000-000000000031'::UUID,
  'speed_scan',
  'dataset_1',
  'Web Performance Optimization Strategies',
  'Learn essential techniques for optimizing web application performance and delivering fast user experiences.',
  'Web performance directly impacts user experience, conversion rates, and search engine rankings. Understanding performance optimization strategies helps developers build applications that feel instant, even on slow networks.

The critical rendering path determines how quickly browsers can display content. HTML parsing creates the DOM, CSS parsing builds the CSSOM, and JavaScript execution can block both processes. Optimizing this path starts with minimizing render-blocking resources: inline critical CSS, defer non-critical JavaScript, and load scripts asynchronously when possible. Code splitting breaks large JavaScript bundles into smaller chunks that load on demand, reducing initial page weight.

Image optimization often yields the biggest performance wins because images typically account for the majority of page weight. Modern formats like WebP and AVIF offer superior compression compared to JPEG and PNG. Responsive images using srcset serve appropriately sized images based on device capabilities. Lazy loading defers offscreen images until users scroll near them, dramatically reducing initial page load. The loading="lazy" attribute makes this trivial to implement.

Caching strategies leverage browser and CDN caches to serve repeat visits instantly. Cache-Control headers tell browsers how long to store resources locally. Immutable assets with content hashes in filenames can be cached forever. Service workers enable sophisticated caching strategies, offline functionality, and instant navigation. HTTP/2 and HTTP/3 improve performance through multiplexing, header compression, and prioritization without code changes.

Measuring performance requires real-world data, not just lab tests. Core Web Vitals—Largest Contentful Paint, First Input Delay, and Cumulative Layout Shift—quantify user experience. Lighthouse provides automated audits and recommendations. Real User Monitoring captures performance data from actual users across diverse networks and devices. Focus optimization efforts on metrics that impact user experience rather than vanity numbers.',
  '{"scan_time_seconds": 30, "info_recall_count": 3}',
  'intermediate',
  90
);

-- Speed Scan dataset_2 (Web Performance Optimization - same content, different config)
INSERT INTO exercises (
  id,
  exercise_type,
  dataset_id,
  title,
  description,
  content,
  config,
  difficulty,
  estimated_duration_seconds
) VALUES (
  'a0000000-0000-0000-0000-000000000032'::UUID,
  'speed_scan',
  'dataset_2',
  'Web Performance Optimization Strategies',
  'Learn essential techniques for optimizing web application performance and delivering fast user experiences.',
  'Web performance directly impacts user experience, conversion rates, and search engine rankings. Understanding performance optimization strategies helps developers build applications that feel instant, even on slow networks.

The critical rendering path determines how quickly browsers can display content. HTML parsing creates the DOM, CSS parsing builds the CSSOM, and JavaScript execution can block both processes. Optimizing this path starts with minimizing render-blocking resources: inline critical CSS, defer non-critical JavaScript, and load scripts asynchronously when possible. Code splitting breaks large JavaScript bundles into smaller chunks that load on demand, reducing initial page weight.

Image optimization often yields the biggest performance wins because images typically account for the majority of page weight. Modern formats like WebP and AVIF offer superior compression compared to JPEG and PNG. Responsive images using srcset serve appropriately sized images based on device capabilities. Lazy loading defers offscreen images until users scroll near them, dramatically reducing initial page load. The loading="lazy" attribute makes this trivial to implement.

Caching strategies leverage browser and CDN caches to serve repeat visits instantly. Cache-Control headers tell browsers how long to store resources locally. Immutable assets with content hashes in filenames can be cached forever. Service workers enable sophisticated caching strategies, offline functionality, and instant navigation. HTTP/2 and HTTP/3 improve performance through multiplexing, header compression, and prioritization without code changes.

Measuring performance requires real-world data, not just lab tests. Core Web Vitals—Largest Contentful Paint, First Input Delay, and Cumulative Layout Shift—quantify user experience. Lighthouse provides automated audits and recommendations. Real User Monitoring captures performance data from actual users across diverse networks and devices. Focus optimization efforts on metrics that impact user experience rather than vanity numbers.',
  '{"scan_time_seconds": 45, "info_recall_count": 4}',
  'advanced',
  120
);
