import java.util.*;

class Solution {
    public int solution(int n, int[][] computers) {

        Deque<Integer> stack = new ArrayDeque<>();

        boolean visit[][] = new boolean[n][n];

        int count = 0;

        for(int i = 0; i < n; i++){
            boolean isPush = false;
            for(int j = 0; j < n; j++){
                if(computers[i][j] == 1 && !visit[i][j] && !visit[j][i]){
                    stack.push(j);
                    visit[i][j] = true;
                    visit[j][i] = true;
                    isPush = true;
                }
            }
            if(isPush){
                count++;
            }
            while(!stack.isEmpty()){
                int cur = stack.pop();

                for(int k = 0; k < n; k++){
                    if(computers[cur][k] == 1 && !visit[cur][k] && !visit[k][cur]){
                        visit[cur][k] = true;
                        visit[k][cur] = true;
                        stack.push(k);
                    }
                }
            }
        }


        return count;
    }
}