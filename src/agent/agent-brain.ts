import {createPlan} from './planner';
export async function runAgent(goal:string){const plan=createPlan(goal);return {plan,status:plan.missing.length?'waiting_for_input':'ready'};}
