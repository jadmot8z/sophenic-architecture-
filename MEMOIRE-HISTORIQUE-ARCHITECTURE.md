# Mémoire et historique SOPHENIC 11

La mémoire ne copie plus chaque message utilisateur. `stableMemory()` retient seulement les identités, préférences, contraintes, objectifs et faits de projet durables, ou les éléments explicitement mémorisés/épinglés.

Chaque entrée possède un scope (`user`, `preference`, `project`), un type, une importance et éventuellement un projet. Avant chaque requête, `memoryPrompt(query, projectId)` classe les éléments par pertinence lexicale, projet, importance, épinglage et récence, puis applique un budget strict.

L'historique reste séparé en Chat, Code et Image. La barre latérale affiche les trois éléments les plus récents par catégorie et la flèche développe la liste ; la page Historique permet la recherche globale. Une nouvelle session sauvegarde immédiatement le chat actif, crée un nouvel identifiant et le titre est dérivé de la première demande.
