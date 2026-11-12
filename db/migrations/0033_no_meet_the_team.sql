UPDATE blocks SET value = replace(value, ' [Meet the team](https://www.youtube.com/watch?v=N3I5WNw7kmk).', '') WHERE key = 'charity_body';
