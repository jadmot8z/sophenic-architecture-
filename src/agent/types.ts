export type ToolParameter={name:string;required?:boolean;description:string;question?:string};
export type AgentTool={name:string;description:string;parameters:ToolParameter[]};
export type AgentPlan={goal:string;steps:string[];missing:string[];tools:string[]};
