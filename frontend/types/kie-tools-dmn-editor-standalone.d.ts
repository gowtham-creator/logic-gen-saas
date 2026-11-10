declare module '@kie-tools/dmn-editor-standalone' {
    export interface DmnEditorOptions {
        container: HTMLElement;
        initialContent: Promise<string>;
        readOnly?: boolean;
        origin?: string;
    }

    export interface DmnEditorInstance {
        close(): void;
        getContent(): Promise<string>;
        setContent(content: string): Promise<void>;
    }

    export class DmnEditor {
        static open(options: DmnEditorOptions): Promise<DmnEditorInstance>;
    }
}
