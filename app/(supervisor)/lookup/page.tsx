// SPDX-License-Identifier: AGPL-3.0-only

import { redirect } from 'next/navigation';

/** Preserve bookmarks; recipient search now lives in Collections. */
export default async function LookupPage() {
  redirect('/weigh');
}
