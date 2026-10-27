import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Redo, Undo } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

export default function MarkdownTextInput(props: {
  text?: string;
  setText: (text: string) => void;
  title?: string | React.ReactNode;
  textSize?: 'small' | 'large';
  disabled?: boolean;
}) {
  const { text, setText, title, textSize = 'large', disabled = false } = props;

  const editorRef = useRef<Editor | null>(null);
  const lastText = useRef(text);
  const editor: Editor | null = useEditor(
    {
      extensions: [
        StarterKit.configure({
          bulletList: {
            keepMarks: true,
            keepAttributes: false, // TODO : Making this as `false` becase marks are not preserved when I try to preserve attrs, awaiting a bit of help
          },
          orderedList: {
            keepMarks: true,
            keepAttributes: false, // TODO : Making this as `false` becase marks are not preserved when I try to preserve attrs, awaiting a bit of help
          },
        }),
      ],
      editorProps: {
        attributes: {
          class: `bg-white outline-none focus:outline-none w-full px-6 border-solid border inline-block mr-3 cursor-text py-4 border-slate-200 focus:border-slate-200 outline-0 placeholder-slate-300 text-slate-700 rounded min-h-48 max-h-96 overflow-y-scroll ${
            textSize === 'small' ? 'text-base px-3 py-2' : 'text-lg px-6 py-4'
          }`,
        },
      },
      content: `${text ?? ''}`,
      onUpdate: ({ editor }) => {
        // Update local state and parent state when content changes
        const newContent = editor.getHTML();

        setText(newContent);
      },
    },
    [],
  );

  // NB: This is needed because the editor only focuses when the user clicks on
  // the editor content, and not when the user clicks elsewhere in the editor.
  useLayoutEffect(() => {
    editorRef.current = editor;
  }, [editor]);
  const focusEditor = () => {
    if (editorRef.current && !disabled) {
      editorRef.current.commands.focus();
    }
  };

  useMemo(() => {
    editor?.setOptions({
      editable: !disabled,
      editorProps: {
        attributes: {
          class: `bg-white outline-none focus:outline-none w-full px-6 border-solid border inline-block mr-3 cursor-text py-4 border-slate-200 focus:border-slate-200 outline-0 placeholder-slate-300 rounded min-h-48 max-h-96 overflow-y-scroll ${
            textSize === 'small' ? 'text-base px-3 py-2' : 'text-lg px-6 py-4'
          } ${
            disabled
              ? 'text-slate-400 cursor-wait'
              : 'text-slate-700 cursor-default'
          }`,
        },
      },
    });
  }, [disabled, editor, textSize]);

  useEffect(() => {
    if (!editor || lastText.current === text) {
      return;
    }
    lastText.current = text;
    if (editor.getHTML() === (text ?? '')) {
      return;
    }
    // NB: Need this due to weird behavior in tiptap editor.
    // See: https://github.com/ueberdosis/tiptap/issues/4167
    const { from, to } = editor.state.selection;
    editor.commands.setContent(text ?? '', false, {
      preserveWhitespace: 'full',
    });
    editor.commands.setTextSelection({ from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const actions = [
    {
      label: 'Bold',
      icon: Bold,
      active: editor?.isActive('bold'),
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      icon: Italic,
      active: editor?.isActive('italic'),
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Bulleted list',
      icon: List,
      active: editor?.isActive('bulletList'),
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered list',
      icon: ListOrdered,
      active: editor?.isActive('orderedList'),
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Undo',
      icon: Undo,
      disabled: !editor?.can().undo(),
      run: () => editor?.chain().focus().undo().run(),
    },
    {
      label: 'Redo',
      icon: Redo,
      disabled: !editor?.can().redo(),
      run: () => editor?.chain().focus().redo().run(),
    },
  ];

  return (
    <div className="flex flex-col w-full">
      {title ? <div className="pb-4 text-lg font-bold">{title}</div> : null}
      <div
        role="group"
        aria-label="Text formatting"
        className="flex flex-wrap items-center gap-1 p-2 mb-1 border border-solid rounded border-slate-200 bg-slate-50"
      >
        <select
          aria-label="Text style"
          disabled={disabled || !editor}
          value={
            editor?.isActive('heading')
              ? editor.getAttributes('heading').level
              : 'paragraph'
          }
          onChange={(event) => {
            const value = event.target.value;
            if (value === 'paragraph') {
              editor?.chain().focus().setParagraph().run();
            } else {
              editor
                ?.chain()
                .focus()
                .setHeading({ level: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 })
                .run();
            }
          }}
          className="h-8 px-2 mr-2 text-sm bg-white border border-solid rounded border-slate-200 focus-visible:outline-indigo-500 disabled:opacity-40"
        >
          <option value="paragraph">Normal text</option>
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <option key={level} value={level}>
              Heading {level}
            </option>
          ))}
        </select>
        {actions.map(
          ({ label, icon: Icon, active, disabled: unavailable, run }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={active}
              disabled={disabled || !editor || unavailable}
              onMouseDown={(event) => event.preventDefault()}
              onClick={run}
              className={`flex items-center justify-center w-8 h-8 rounded hover:bg-slate-200 focus-visible:outline-indigo-500 disabled:opacity-40 disabled:hover:bg-transparent ${
                active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600'
              }`}
            >
              <Icon size={16} aria-hidden="true" />
            </button>
          ),
        )}
      </div>
      <EditorContent
        className="prose prose-slate max-w-none [&_.tiptap>:first-child]:mt-0 [&_.tiptap>:last-child]:mb-0"
        editor={editor}
        placeholder={'Do not post content that...'}
        onClick={() => {
          if (!disabled) {
            focusEditor();
          }
        }}
      />
    </div>
  );
}
