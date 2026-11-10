// types/message.ts  ← create this file
export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: string;
  type?: 'text' | 'code';        // new!
  language?: string;             // for code blocks (e.g., "typescript", "json", "dmn")
  dmnXml?: string;               // generated DMN XML attached to this message
}