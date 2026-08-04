import java.util.*;

class Solution {
    public int solution(int n, int[][] wires) {

        List<List<Integer>> top = new ArrayList<>();
        for(int i = 0; i < n+1; i++){
            top.add(new ArrayList<>());
        }

        for(int i = 0; i < wires.length; i++){
            int a = wires[i][0];
            int b = wires[i][1];
            top.get(a).add(b);
            top.get(b).add(a);
        }

        int result = Integer.MAX_VALUE;

        for(int i = 0; i < wires.length; i++){
            int a = wires[i][0];
            int b = wires[i][1];

            int[] visited = new int[n+1];
            visited[a] = 1;
            visited[b] = 1;

            int acut = visit(top, visited, a);
            int bcut = n-acut;
            result = Math.min(result, (Math.max(acut, bcut) - Math.min(acut, bcut)));
        }


        return result;
    }

    public int visit(List<List<Integer>> list, int[] visited, int a){
        int count = 0;
        int sum = 1;
        for(int i = 0; i < list.get(a).size(); i++){
            if(visited[list.get(a).get(i)] == 1){
                continue;
            }
            visited[list.get(a).get(i)] = 1;
            sum += visit(list, visited, list.get(a).get(i));
            count++;
        }
        return sum;
    }
}