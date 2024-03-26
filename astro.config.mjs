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
                        { label: 'DAGs', link: '/internals/dags/', badge: 'New' },
                        { label: 'Schedules', link: '/internals/schedules/' },
                        { label: 'DagWatcher', link: '/internals/dagwatcher/' },
                        { label: 'TaskScheduler', link: '/internals/taskscheduler/' },
                        { label: 'Logging', link: '/internals/loggers/' },
                        { label: 'Databases', link: '/internals/dbs/' },
                    ]
                },
            ],
        }),
    ],
});
