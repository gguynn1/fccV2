export enum InputMethod {
  Text = "text",
  Image = "image",
}

export interface InputRecognition {
  text: { description: string };
  structured_choice: { description: string; formats: string[] };
  reaction: { positive: string; negative: string };
  image: { description: string; examples: Record<string, string> };
  forwarded_content: { description: string };
  silence: {
    high_accountability: string;
    low_accountability: string;
    never: string;
  };
}
