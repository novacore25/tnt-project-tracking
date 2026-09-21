import React, { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Trash2, Edit2, Check, X, Send } from 'lucide-react';

export type TimelineNote = {
  id: string;
  isi: string;
  author_id: string;
  author_name: string;
  created_at: string;
};

interface NotesTimelineProps {
  title: string;
  rawNotes: string | null;
  onSave: (newRawNotes: string) => Promise<void>;
  hasAccess: boolean;
}

export function NotesTimeline({ title, rawNotes, onSave, hasAccess }: NotesTimelineProps) {
  const { profile } = useAuth();
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Parse notes safely
  let notes: TimelineNote[] = [];
  if (rawNotes) {
    try {
      const parsed = JSON.parse(rawNotes);
      if (Array.isArray(parsed)) {
        notes = parsed;
      } else {
        notes = [{ id: 'legacy', isi: rawNotes, author_id: 'system', author_name: 'System', created_at: new Date().toISOString() }];
      }
    } catch (err) {
      notes = [{ id: 'legacy', isi: rawNotes, author_id: 'system', author_name: 'System', created_at: new Date().toISOString() }];
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || !profile) return;
    setIsSaving(true);
    const newEntry: TimelineNote = {
      id: Date.now().toString() + Math.random().toString(36).substring(2),
      isi: newNote.trim(),
      author_id: profile.id,
      author_name: profile.nama || 'User',
      created_at: new Date().toISOString(),
    };
    
    const updatedNotes = [...notes, newEntry];
    await onSave(JSON.stringify(updatedNotes));
    setNewNote('');
    setIsSaving(false);
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editContent.trim()) return;
    setIsSaving(true);
    const updatedNotes = notes.map(n => n.id === noteId ? { ...n, isi: editContent.trim() } : n);
    await onSave(JSON.stringify(updatedNotes));
    setEditingNoteId(null);
    setIsSaving(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Yakin ingin menghapus catatan ini?')) return;
    setIsSaving(true);
    const updatedNotes = notes.filter(n => n.id !== noteId);
    await onSave(JSON.stringify(updatedNotes));
    setIsSaving(false);
  };

  return (
    <div className="flex flex-col h-full">
      <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[8px]">{title}</h5>
      
      <div className="flex-1 overflow-y-auto max-h-[250px] pr-2 space-y-3 mb-3 custom-scrollbar">
        {notes.length === 0 ? (
          <p className="text-[11px] text-text-soft italic">Belum ada catatan.</p>
        ) : (
          notes.map(note => {
            const isMine = note.author_id === profile?.id;
            const isEditing = editingNoteId === note.id;

            return (
              <div key={note.id} className="bg-white border border-line rounded-lg p-3 shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[12px] text-text">{note.author_name}</span>
                    <span className="text-[10px] text-text-soft">{new Date(note.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                  {!isEditing && isMine && hasAccess && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingNoteId(note.id); setEditContent(note.isi); }} className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"><Edit2 className="w-3 h-3" /></button>
                      <button onClick={() => handleDeleteNote(note.id)} className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
                
                {isEditing ? (
                  <div className="mt-2">
                    <textarea 
                      value={editContent} 
                      onChange={e => setEditContent(e.target.value)}
                      className="input w-full text-[12px] min-h-[60px]"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setEditingNoteId(null)} className="btn btn-outline py-1 px-2 text-[11px]"><X className="w-3 h-3 mr-1" /> Batal</button>
                      <button onClick={() => handleUpdateNote(note.id)} disabled={isSaving} className="btn py-1 px-2 text-[11px]"><Check className="w-3 h-3 mr-1" /> Simpan</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-text whitespace-pre-wrap">{note.isi}</p>
                )}
              </div>
            );
          })
        )}
      </div>

      {hasAccess && (
        <div className="mt-auto border-t border-line pt-3 flex gap-2">
          <input 
            type="text" 
            placeholder="Ketik catatan baru..." 
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
            className="input flex-1 !py-1.5 text-[12px]"
          />
          <button 
            onClick={handleAddNote} 
            disabled={!newNote.trim() || isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 flex items-center justify-center disabled:opacity-50 transition-colors"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
