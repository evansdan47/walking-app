'use client';

import { useState } from 'react';
import type { QuestionnaireAnswers } from '@/lib/tag-questionnaire-mapping';

type TagQuestionnaireProps = {
  onChange: (answers: QuestionnaireAnswers) => void;
  maxQuestions?: number;
};

function OptionGroup({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: { id: string; label: string }[];
  value?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset className="mb-4">
      <legend className="text-xs font-semibold text-slate mb-2">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              value === opt.id
                ? 'bg-brand text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function TagQuestionnaire({ onChange, maxQuestions = 7 }: TagQuestionnaireProps) {
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});

  function update(patch: Partial<QuestionnaireAnswers>) {
    const next = { ...answers, ...patch };
    setAnswers(next);
    onChange(next);
  }

  function toggleFacility(id: string) {
    const current = new Set(answers.facilities ?? []);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    update({ facilities: [...current] });
  }

  return (
    <div className="max-h-80 overflow-y-auto pr-1">
      <OptionGroup
        label="What best describes the landscape?"
        {...(answers.landscape !== undefined ? { value: answers.landscape } : {})}
        onSelect={(landscape) => update({ landscape })}
        options={[
          { id: 'coastal', label: 'Coastal' },
          { id: 'woodland', label: 'Woodland' },
          { id: 'countryside', label: 'Countryside' },
          { id: 'mountain', label: 'Mountain' },
          { id: 'urban', label: 'Urban' },
          { id: 'mixed', label: 'Mixed' },
        ]}
      />

      <OptionGroup
        label="How challenging was the walk?"
        {...(answers.difficulty !== undefined ? { value: answers.difficulty } : {})}
        onSelect={(difficulty) => update({ difficulty })}
        options={[
          { id: 'very_easy', label: 'Very easy' },
          { id: 'easy', label: 'Easy' },
          { id: 'moderate', label: 'Moderate' },
          { id: 'hard', label: 'Hard' },
          { id: 'challenging', label: 'Challenging' },
        ]}
      />

      {maxQuestions >= 3 && (
        <OptionGroup
          label="How were the views?"
          {...(answers.views !== undefined ? { value: answers.views } : {})}
          onSelect={(views) => update({ views })}
          options={[
            { id: 'poor', label: 'Poor' },
            { id: 'average', label: 'Average' },
            { id: 'good', label: 'Good' },
            { id: 'excellent', label: 'Excellent' },
          ]}
        />
      )}

      {maxQuestions >= 4 && (
        <fieldset className="mb-4">
          <legend className="text-xs font-semibold text-slate mb-2">Were there any facilities?</legend>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'parking', label: 'Parking' },
              { id: 'toilets', label: 'Toilets' },
              { id: 'cafe', label: 'Café' },
              { id: 'pub', label: 'Pub' },
              { id: 'visitor_centre', label: 'Visitor centre' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleFacility(opt.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  answers.facilities?.includes(opt.id)
                    ? 'bg-brand text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {maxQuestions >= 5 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => update({ dogFriendly: !answers.dogFriendly })}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
              answers.dogFriendly ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Dog friendly
          </button>
          <button
            type="button"
            onClick={() => update({ peaceful: !answers.peaceful })}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
              answers.peaceful ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Peaceful
          </button>
        </div>
      )}
    </div>
  );
}
