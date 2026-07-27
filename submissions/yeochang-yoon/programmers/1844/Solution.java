import java.util.*;

class Solution {
    public int solution(int[][] maps) {

        int n = maps.length;
        int m = maps[0].length;

        int[][] visit = new int[n][m];
        visit[0][0] = 1;

        int[] dr = {0, 0, 1, -1};
        int[] dc = {1, -1, 0, 0};

        Queue<int[]> queue = new ArrayDeque<>();
        queue.offer(new int[] {0, 0});

        while(!queue.isEmpty()){
            int[] cur = queue.poll();

            for(int i = 0; i < 4; i++){
                int nr = cur[0] + dr[i];
                int nc = cur[1] + dc[i];

                if(nr < 0 || nr >= n || nc < 0 || nc >= m){
                    continue;
                }
                if(maps[nr][nc] == 0){
                    continue;
                }
                if(visit[nr][nc] != 0){
                    continue;
                }
                visit[nr][nc] = visit[cur[0]][cur[1]] + 1;
                queue.offer(new int[] {nr, nc});
            }
        }

        if(visit[n-1][m-1] == 0){
            return -1;
        }

        int answer = visit[n-1][m-1];
        return answer;
    }
}