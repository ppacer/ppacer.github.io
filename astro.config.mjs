import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
    site: 'https://docs.ppacer.org',
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
                        { label: 'High-level design', link: '/overview/hld/' },
                    ]
                },
                {
                    label: 'Internals',
                    items: [
                        { label: 'DAGs', link: '/internals/dags/' },
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
