import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import type { APIContext } from 'astro'

export async function GET(context: APIContext) {
  const notes = (await getCollection('notes')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  )
  return rss({
    title: 'Remotely Human — Notes',
    description: 'Field notes from Remotely Human. Unthemed, interlinked, occasionally useful.',
    site: context.site!,
    items: notes.map((note) => ({
      title: note.data.title,
      pubDate: note.data.date,
      description: note.data.description,
      link: `/notes/${note.id}`,
    })),
  })
}
