export interface CurriculumTopic {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly parentTopicId?: string;
}

export interface CompetencyIndicator {
  readonly code: string;
  readonly description: string;
}

export interface LearningObjective {
  readonly id: string;
  readonly description: string;
}

export interface TopicHierarchy {
  readonly rootTopic: CurriculumTopic;
  readonly childTopics: readonly CurriculumTopic[];
}

export function createCurriculumTopic(input: CurriculumTopic): CurriculumTopic {
  return Object.freeze({ ...input });
}

export function createTopicHierarchy(input: TopicHierarchy): TopicHierarchy {
  return Object.freeze({
    childTopics: Object.freeze(
      input.childTopics.map((topic) => Object.freeze({ ...topic })),
    ),
    rootTopic: createCurriculumTopic(input.rootTopic),
  });
}
