import java.util.*;

class Solution {
    public int solution(int[][] routes) {

        Arrays.sort(routes, (a, b) -> {
            if(a[0] != b[0]){
                return Integer.compare(a[0], b[0]);
            }
            return Integer.compare(a[1], b[1]);
        });

        int ps = routes[0][0];
        int pe = routes[0][1];
        int count = 1;

        for(int i = 1; i < routes.length; i++){
            int ns = routes[i][0];
            int ne = routes[i][1];

            if(ns <= pe){
                ps = ns;
                if(ne <= pe){
                    pe = ne;
                }

            } else{
                count++;
                ps = ns;
                pe = ne;
            }
        }



        int answer = count;
        return answer;
    }
}