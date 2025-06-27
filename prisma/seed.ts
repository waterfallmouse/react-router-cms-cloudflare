import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create default content types
  const blogPostType = await prisma.contentType.upsert({
    where: { name: 'blog_post' },
    update: {},
    create: {
      name: 'blog_post',
      displayName: 'Blog Post',
      description: 'Standard blog post content type',
      fields: JSON.stringify({
        title: { type: 'string', required: true, maxLength: 200 },
        body: { type: 'text', required: true },
        excerpt: { type: 'text', required: false, maxLength: 500 },
        featured_image: { type: 'media', required: false }
      }),
      isActive: true
    }
  })

  const pageType = await prisma.contentType.upsert({
    where: { name: 'page' },
    update: {},
    create: {
      name: 'page',
      displayName: 'Page',
      description: 'Static page content type',
      fields: JSON.stringify({
        title: { type: 'string', required: true, maxLength: 200 },
        body: { type: 'text', required: true }
      }),
      isActive: true
    }
  })

  // Create sample content
  const sampleBlogPost = await prisma.content.upsert({
    where: { slug: 'hello-world' },
    update: {},
    create: {
      title: 'Hello World',
      slug: 'hello-world',
      body: '# Hello World\n\nThis is a sample blog post to demonstrate the CMS functionality.\n\n## Features\n\n- Markdown support\n- Media management\n- SEO optimization\n- Responsive design\n\nWelcome to our new CMS built with React Router v7 and Cloudflare Workers!',
      excerpt: 'Welcome to our new CMS built with React Router v7 and Cloudflare Workers!',
      status: 'published',
      contentTypeId: blogPostType.id
    }
  })

  const aboutPage = await prisma.content.upsert({
    where: { slug: 'about' },
    update: {},
    create: {
      title: 'About',
      slug: 'about',
      body: '# About Us\n\nThis is a sample about page created with our DDD-based CMS.\n\n## Technology Stack\n\n- React Router v7\n- Cloudflare Workers\n- Cloudflare D1 Database\n- Cloudflare R2 Storage\n- TypeScript\n- Tailwind CSS\n\nBuilt with Domain-Driven Design principles for scalability and maintainability.',
      excerpt: 'Learn more about our technology stack and development approach.',
      status: 'published',
      contentTypeId: pageType.id
    }
  })

  console.log('✅ Database seeded successfully!')
  console.log('📄 Created content types:', { blogPostType: blogPostType.name, pageType: pageType.name })
  console.log('📝 Created sample content:', { sampleBlogPost: sampleBlogPost.title, aboutPage: aboutPage.title })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e)
    await prisma.$disconnect()
    process.exit(1)
  })