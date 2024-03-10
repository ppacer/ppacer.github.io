import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
    site: 'https://ppacer.github.io',
    integrations: [
        starlight({
            title: 'ppacer docs',
            social: {
                github: 'https://github.com/ppacer',
            },
            sidebar: [
                {
                    label: 'Getting started',
                    items: [
                        { label: 'Intro', link: '/start/intro/' },
                    ],
                },
                {
                    label: 'Overview',
                    items: [
                        { label: 'High-level design', link: '' },
                    ]
                },
                {
                    label: 'Internals',
                    items: [
                        { label: 'DagWatcher', link: '' },
                        { label: 'TaskScheduler', link: '' },
                        { label: 'Schedule', link: '' },
                        { label: 'Loggers', link: '' },
                        { label: 'Databases', link: '' },
                    ]
                },
            ],
        }),
    ],
});
