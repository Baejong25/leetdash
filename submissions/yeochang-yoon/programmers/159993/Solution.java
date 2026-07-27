import java.util.*;

class Solution {
    public int solution(String[] maps) {

        int n = maps.length;
        int m = maps[0].length();

        int[][] p = new int[3][2];

        for(int i = 0; i < n; i++){
            for(int j = 0; j < m; j++){
                if(maps[i].charAt(j) == 'S'){
                    p[0][0] = i;
                    p[0][1] = j;
                } else if(maps[i].charAt(j) == 'L'){
                    p[1][0] = i;
                    p[1][1] = j;
                } else if(maps[i].charAt(j) == 'E'){
                    p[2][0] = i;
                    p[2][1] = j;
                }
            }
        }

        int[][] visitL = new int[n][m];
        int[][] visitE = new int[n][m];

        int[] dr = {0, 0, 1, -1};
        int[] dc = {1, -1, 0, 0};

        Queue<int[]> queue = new ArrayDeque<>();
        queue.offer(new int[] {p[0][0], p[0][1]});

        while(!queue.isEmpty()){
            int[] cur = queue.poll();

            for(int i = 0; i < 4; i++){
                int nr = cur[0] + dr[i];
                int nc = cur[1] + dc[i];

                if(nr < 0 || nr >= n || nc < 0 || nc >= m){
                    continue;
                }
                if(maps[nr].charAt(nc) == 'X'){
                    continue;
                }
                if(visitL[nr][nc] > 0){
                    continue;
                }

                visitL[nr][nc] = visitL[cur[0]][cur[1]] + 1;
                queue.offer(new int[] {nr, nc});
            }
        }

        if(visitL[p[1][0]][p[1][1]] == 0){
            return -1;
        }

        queue.offer(new int[] {p[1][0], p[1][1]});
        visitE[p[1][0]][p[1][1]] = visitL[p[1][0]][p[1][1]];

        while(!queue.isEmpty()){
            int[] cur = queue.poll();

            for(int i = 0; i < 4; i++){
                int nr = cur[0] + dr[i];
                int nc = cur[1] + dc[i];

                if(nr < 0 || nr >= n || nc < 0 || nc >= m){
                    continue;
                }
                if(maps[nr].charAt(nc) == 'X'){
                    continue;
                }
                if(visitE[nr][nc] > 0){
                    continue;
                }

                visitE[nr][nc] = visitE[cur[0]][cur[1]] + 1;
                queue.offer(new int[] {nr, nc});
            }
        }

        if(visitE[p[2][0]][p[2][1]] == 0){
            return -1;
        }

        int answer = visitE[p[2][0]][p[2][1]];
        return answer;
    }
}