import java.util.*;

class Solution {
    public int[] solution(String[] maps) {

        int m = maps.length;
        int n = maps[0].length();

        int[][] grid = new int[m][n];

        for(int i = 0; i < m; i++){
            for(int j = 0; j < n; j++){
                char c = maps[i].charAt(j);
                if(c == 'X'){
                    grid[i][j] = 0;
                }else{
                    grid[i][j] = c - '0';
                }
            }
        }

        boolean[][] visit = new boolean[m][n];

        int[] dr = {1, -1, 0, 0};
        int[] dc = {0, 0, 1, -1};

        List<Integer> days = new ArrayList<>();

        Queue<int[]> queue = new ArrayDeque<>();

        for(int i = 0; i < m; i++){
            for(int j = 0; j < n; j++){
                if(grid[i][j] != 0 && !visit[i][j]){
                    queue.offer(new int[] {i, j});
                    visit[i][j] = true;
                    int sum = grid[i][j];

                    while(!queue.isEmpty()){
                        int[] cur = queue.poll();

                        for(int k = 0; k < 4; k++){
                            int nr = cur[0] + dr[k];
                            int nc = cur[1] + dc[k];

                            if(nr < 0 || nr >= m || nc < 0 || nc >= n){
                                continue;
                            }
                            if(grid[nr][nc] == 0){
                                continue;
                            }
                            if(visit[nr][nc]){
                                continue;
                            }

                            sum += grid[nr][nc];
                            visit[nr][nc] = true;
                            queue.offer(new int[] {nr, nc});
                        }
                    }
                    days.add(sum);
                }
            }
        }

        if(days.size() == 0){
            return new int[] {-1};
        }


        int[] answer = new int[days.size()];

        for(int i = 0; i < days.size(); i++){
            answer[i] = days.get(i);
        }
        Arrays.sort(answer);
        return answer;
    }
}