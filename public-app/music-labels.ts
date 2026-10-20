// Shared labels only. Internal IDs remain unchanged in every API and database row.
export const collectionNames: Record<string,string> = {
  'beginner-pieces':'Beginner Pieces', 'schmitt-op16':'Schmitt Op. 16',
  'hannah-smith-part1':'Hannah Smith Part 1', 'sight-reading':'Hanon',
  'bach':'Bach', 'burgmuller-op100':'Burgmüller Op. 100', 'scales':'Scales',
  'classical-foundations':'Classical Foundations', 'moonlight':'Moonlight Sonata',
  'repertoire':'Repertoire', 'repertoire-archived':'Archived Repertoire',
};
export const collectionName=(id:string)=>collectionNames[id]??id.split(/[-_]/).map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' ');
