import type {AgentTool} from './types';
export const agentTools:AgentTool[]=[
{name:'gmail.send_email',description:'Send an email',parameters:[{name:'to',required:true,description:'Recipient address',question:'À quelle adresse dois-je envoyer cet email ?'},{name:'subject',required:true,description:'Email subject',question:'Quel est le sujet de cet email ?'},{name:'body',required:true,description:'Email content',question:'Quel contenu dois-je envoyer ?'}]},
{name:'canva.create_design',description:'Create a design asset',parameters:[{name:'prompt',required:true,description:'Design brief',question:'Quel visuel dois-je créer ?'}]},
{name:'google_calendar.create_event',description:'Create calendar event',parameters:[{name:'title',required:true,description:'Event title',question:'Quel est le titre de l’événement ?'}]}
];
export function findTool(name:string){return agentTools.find(t=>t.name===name)}
