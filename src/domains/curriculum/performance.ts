import type {Exercise} from '../../../hosted/sight-library';
import type {Challenge,RealmScore} from '../realms/types';
export const lessonChallenge:Challenge={id:'lesson-timing',title:'Lesson performance',subtitle:'',kind:'tempo',objective:'Keep a steady pulse; pitch and timing are assessed separately.',requires:[],level:2,measures:8,hands:'both',reward:''};
export const lessonScore=(exercise:Exercise,tempo=exercise.tempoBpm!):RealmScore=>({exercise:{...exercise,tempoBpm:tempo},phrases:[{start:0,end:exercise.durationBeats!,title:'Complete passage'}],phases:[]});
