import {findTool} from './tool-registry';
import type {AgentPlan} from './types';
export function createPlan(goal:string):AgentPlan{
 const tools:string[]=[]; if(/email|mail/i.test(goal)) tools.push('gmail.send_email'); if(/instagram|publication|design|visuel/i.test(goal)) tools.push('canva.create_design');
 const missing=tools.flatMap(t=>findTool(t)?.parameters.filter(p=>p.required).map(p=>p.question||p.name)||[]);
 return {goal,steps:['Comprendre objectif','Choisir outils','Collecter informations','Exécuter','Vérifier','Rapport'],missing,tools};
}
