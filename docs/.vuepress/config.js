module.exports = {
  title: '远书',
  description: '武杰的博客',
  base: '/farbook/',
  repo: 'https://github.com/OutisJie/farbook',
  head: [
    ['link', { rel: 'icon', href: '/img/favicon.ico' }]
  ],
  themeConfig: {
    nav: [
      { text: '主页', link: '/' },
      { text: '学习', link: '/learn/' },
      { text: '手记', link: '/handnote/' },
      { text: '关于', link: '/about/' },
      { text: 'GitHub', link: 'https://github.com/OutisJie/farbook' }
    ],
    sidebar: {
      '/learn/': [
        '',
        'fe'
      ],
      '/handnote/': [
        '',
        'hangzhou'
      ],
      '/about/': [
        '',
        'outisjie'
      ]
    }
  }
}