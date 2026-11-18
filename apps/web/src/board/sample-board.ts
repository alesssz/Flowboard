// Sample board rendered until the API serves boards.
import type { Board, Label } from '@flowboard/shared';
import { addDays, toCalendarDay } from './due-date.ts';

const design: Label = { id: 'design', name: 'Design', color: 'violet' };
const content: Label = { id: 'content', name: 'Content', color: 'blue' };
const seo: Label = { id: 'seo', name: 'SEO', color: 'green' };
const legal: Label = { id: 'legal', name: 'Legal', color: 'amber' };
const frontend: Label = { id: 'frontend', name: 'Frontend', color: 'coral' };

// Counted from the day the app loads, so the sample always shows every due-date state.
const loadedOn = new Date();
const dueIn = (days: number) => toCalendarDay(addDays(loadedOn, days));

export const sampleBoard: Board = {
  id: 'sample',
  title: 'Website relaunch',
  columns: [
    {
      id: 'todo',
      title: 'To do',
      color: 'gray',
      cards: [
        {
          id: 'pricing-copy',
          title: 'Write the pricing page copy',
          description:
            'Three plans, a comparison table and the FAQ. Legal reviews the refund wording before it goes live, and support checks that the answers match the help centre.',
          labels: [content, legal],
          dueDate: dueIn(5),
        },
        { id: 'hero', title: 'Pick the hero illustration', description: '', labels: [design], dueDate: null },
        {
          id: 'redirects',
          title: 'Redirect the old URLs',
          description: 'Every old path maps to its new page, so search rankings carry over.',
          labels: [seo],
          dueDate: dueIn(60),
        },
        {
          id: 'cookies',
          title: 'Cookie banner',
          description: 'Essential cookies only by default; analytics after consent.',
          labels: [legal, frontend],
          dueDate: dueIn(-2),
        },
      ],
    },
    {
      id: 'in-progress',
      title: 'In progress',
      color: 'coral',
      cards: [
        {
          id: 'navigation',
          title: 'Navigation redesign',
          description: 'Mobile menu first, then the desktop one.',
          labels: [design, frontend],
          dueDate: dueIn(0),
        },
        {
          id: 'blog',
          title: 'Move the blog to the new CMS',
          description: '142 posts. Images keep their alt text; drafts stay unpublished.',
          labels: [content],
          dueDate: dueIn(1),
        },
      ],
    },
    { id: 'blocked', title: 'Blocked', color: 'red', cards: [] },
    {
      id: 'review',
      title: 'Review',
      color: 'blue',
      cards: [
        {
          id: 'contact-form',
          title: 'Contact form',
          description: 'Validation messages and the confirmation state.',
          labels: [frontend],
          dueDate: dueIn(-1),
        },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      color: 'green',
      cards: [
        {
          id: 'brand',
          title: 'Brand colours and type scale',
          description: '',
          labels: [design],
          dueDate: null,
        },
        {
          id: 'analytics',
          title: 'Analytics plan',
          description: 'Events for sign-up, trial start and plan change.',
          labels: [],
          dueDate: null,
        },
      ],
    },
  ],
};
