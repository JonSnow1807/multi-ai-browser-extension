import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Star,
  StarOff,
  Filter,
  Download,
  Upload,
  Code,
  PenTool,
  Globe,
  Briefcase,
  Lightbulb,
  Languages,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { PromptTemplate, PromptCategory } from '@/types/extension';
import { useExtensionStore } from '@/stores/extensionStore';

interface PromptLibraryProps {
  onSelectPrompt: (prompt: PromptTemplate) => void;
}

const categoryIcons: Record<PromptCategory, React.ReactNode> = {
  coding: <Code className="w-4 h-4" />,
  writing: <PenTool className="w-4 h-4" />,
  research: <Globe className="w-4 h-4" />,
  analysis: <Briefcase className="w-4 h-4" />,
  creative: <Lightbulb className="w-4 h-4" />,
  translation: <Languages className="w-4 h-4" />,
  summarization: <FileText className="w-4 h-4" />,
  general: <MessageSquare className="w-4 h-4" />,
};

export const PromptLibrary: React.FC<PromptLibraryProps> = ({ onSelectPrompt }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | 'all'>('all');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const {
    promptTemplates,
    loadPromptTemplates,
    addPromptTemplate,
    updatePromptTemplate,
    deletePromptTemplate,
  } = useExtensionStore();

  useEffect(() => {
    loadPromptTemplates();
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await chrome.storage.local.get('favoritePrompts');
      if (stored.favoritePrompts) {
        setFavorites(new Set(stored.favoritePrompts));
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  const saveFavorites = async (newFavorites: Set<string>) => {
    try {
      await chrome.storage.local.set({
        favoritePrompts: Array.from(newFavorites),
      });
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  };

  const toggleFavorite = (id: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    saveFavorites(newFavorites);
  };

  const filteredPrompts = promptTemplates.filter(prompt => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        prompt.name.toLowerCase().includes(query) ||
        prompt.description.toLowerCase().includes(query) ||
        prompt.template.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (selectedCategory !== 'all' && prompt.category !== selectedCategory) {
      return false;
    }

    // Favorites filter
    if (showFavorites && !favorites.has(prompt.id)) {
      return false;
    }

    return true;
  });

  const handleCreate = async (prompt: Partial<PromptTemplate>) => {
    const newPrompt: PromptTemplate = {
      id: `prompt-${Date.now()}`,
      name: prompt.name || 'New Prompt',
      description: prompt.description || '',
      category: prompt.category || 'general',
      template: prompt.template || '',
      variables: prompt.variables || [],
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    };

    await addPromptTemplate(newPrompt);
    setShowCreateModal(false);
  };

  const handleUpdate = async (prompt: PromptTemplate) => {
    await updatePromptTemplate({
      ...prompt,
      updatedAt: Date.now(),
    });
    setEditingPrompt(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this prompt?')) {
      await deletePromptTemplate(id);
    }
  };

  const handleDuplicate = async (prompt: PromptTemplate) => {
    const duplicated: PromptTemplate = {
      ...prompt,
      id: `prompt-${Date.now()}`,
      name: `${prompt.name} (Copy)`,
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    };

    await addPromptTemplate(duplicated);
  };

  const handleExport = () => {
    const data = JSON.stringify(filteredPrompts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const imported = JSON.parse(text) as PromptTemplate[];

      for (const prompt of imported) {
        await addPromptTemplate({
          ...prompt,
          id: `prompt-${Date.now()}-${Math.random()}`,
          isBuiltIn: false,
        });
      }

      loadPromptTemplates();
    } catch (error) {
      console.error('Failed to import prompts:', error);
      alert('Failed to import prompts. Please check the file format.');
    }
  };

  const groupedPrompts = filteredPrompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = [];
    }
    acc[prompt.category].push(prompt);
    return acc;
  }, {} as Record<PromptCategory, PromptTemplate[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Prompt Library
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              New Prompt
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts..."
            className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto">
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap ${
              showFavorites
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <Star className="w-3 h-3 inline mr-1" />
            Favorites
          </button>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as PromptCategory | 'all')}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
          >
            <option value="all">All Categories</option>
            {Object.keys(categoryIcons).map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>

          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Export prompts"
          >
            <Download className="w-3 h-3" />
          </button>

          <label className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            title="Import prompts">
            <Upload className="w-3 h-3" />
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
              }}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Prompts Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredPrompts.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No prompts found
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'Create your first prompt template'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedPrompts).map(([category, prompts]) => (
              <div key={category}>
                <div className="flex items-center space-x-2 mb-3">
                  {categoryIcons[category as PromptCategory]}
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase">
                    {category}
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({prompts.length})
                  </span>
                </div>

                <div className="grid gap-3">
                  {prompts.map(prompt => (
                    <PromptCard
                      key={prompt.id}
                      prompt={prompt}
                      isFavorite={favorites.has(prompt.id)}
                      onToggleFavorite={() => toggleFavorite(prompt.id)}
                      onSelect={() => onSelectPrompt(prompt)}
                      onEdit={() => setEditingPrompt(prompt)}
                      onDelete={() => handleDelete(prompt.id)}
                      onDuplicate={() => handleDuplicate(prompt)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingPrompt) && (
        <PromptModal
          prompt={editingPrompt}
          onSave={editingPrompt ? handleUpdate : handleCreate}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPrompt(null);
          }}
        />
      )}
    </div>
  );
};

// Prompt Card Component
interface PromptCardProps {
  prompt: PromptTemplate;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  isFavorite,
  onToggleFavorite,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {prompt.name}
          </h4>
          {prompt.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {prompt.description}
            </p>
          )}
        </div>
        <button
          onClick={onToggleFavorite}
          className="p-1 text-gray-400 hover:text-yellow-500"
        >
          {isFavorite ? (
            <Star className="w-4 h-4 fill-current text-yellow-500" />
          ) : (
            <StarOff className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-2 rounded mb-2 font-mono line-clamp-2">
        {prompt.template}
      </div>

      {prompt.variables && prompt.variables.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {prompt.variables.map(variable => (
            <span
              key={variable.name}
              className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded"
            >
              {`{${variable.name}}`}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
          {prompt.isBuiltIn && (
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
              Built-in
            </span>
          )}
          {prompt.usageCount && prompt.usageCount > 0 && (
            <span>Used {prompt.usageCount} times</span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={onSelect}
            className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
            title="Use prompt"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          {!prompt.isBuiltIn && (
            <>
              <button
                onClick={onEdit}
                className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Prompt Modal Component
interface PromptModalProps {
  prompt?: PromptTemplate | null;
  onSave: (prompt: any) => void;
  onClose: () => void;
}

const PromptModal: React.FC<PromptModalProps> = ({ prompt, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: prompt?.name || '',
    description: prompt?.description || '',
    category: prompt?.category || 'general',
    template: prompt?.template || '',
    variables: prompt?.variables || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(prompt ? { ...prompt, ...formData } : formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {prompt ? 'Edit Prompt' : 'Create New Prompt'}
            </h3>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as PromptCategory })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.keys(categoryIcons).map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Template
              </label>
              <textarea
                value={formData.template}
                onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={6}
                required
                placeholder="Use {variable} for dynamic content"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use {'{variable}'} syntax for dynamic variables
              </p>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              {prompt ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};