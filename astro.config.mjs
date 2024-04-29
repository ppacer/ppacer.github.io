import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
    site: 'https://ppacer.org',
    integrations: [
        starlight({
            title: 'ppacer docs',
            description: 'ppacer documentation',
            social: {
                github: 'https://github.com/ppacer/core',
            },
            customCss: [
                './src/styles/custom.css',
            ],
            sidebar: [
                {
                    label: 'API reference',
                    link: 'https://pkg.go.dev/github.com/ppacer/core',
                },
                {
                    label: 'Getting started',
                    items: [
                        { label: 'Intro', link: '/start/intro/' },
                    ],
                },
                {
                    label: 'Overview',
                    items: [
                        {
                            label: 'High-level design',
                            link: '/overview/hld/',
                            badge: { text: 'TODO', variant: 'caution' },
                        },
                    ]
                },
                {
                    label: 'Concepts',
                    items: [
                        { label: 'DAGs', link: '/internals/dags/' },
                        { label: 'Schedules', link: '/internals/schedules/', badge: 'New' },
                        { label: 'Logging', link: '/internals/loggers/' },
                        { label: 'Databases', link: '/internals/dbs/' },
                    ]
                },
            ],
        }),
    ],
});
