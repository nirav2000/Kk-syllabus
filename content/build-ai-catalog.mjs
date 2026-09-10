import fs from 'node:fs';
import {objectives} from '../src/content.js';
import {words} from '../src/words-data.js';
const catalog=[...objectives.flatMap(o=>o.items.map(i=>({id:i.id,title:o.title,question:i.stem,answer:i.answer,hint:i.hint}))),...words.map(w=>({id:w.id,title:'Word meaning and spelling',question:`Explain the word ${w.word}. Context: ${w.sentence}`,answer:w.meaning,hint:'Explain meaning, letter patterns and a new example.'}))];
fs.writeFileSync(new URL('../functions/catalog.json',import.meta.url),JSON.stringify(catalog,null,2)+'\n');
