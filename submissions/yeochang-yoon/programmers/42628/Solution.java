import java.util.*;

class Solution {
    public int[] solution(String[] operations) {

        List<Integer> queue = new ArrayList<>();

        for(int i = 0; i < operations.length; i++){
            String[] tmp = operations[i].split(" ");
            if(tmp[0].equals("I")){
                int a = Integer.parseInt(tmp[1]);
                queue.add(a);
            }
            if(queue.size() > 0 && tmp[0].equals("D")){
                if(tmp[1].equals("1")){
                    queue.remove(queue.size()-1);
                }
                if(tmp[1].equals("-1")){
                    queue.remove(0);
                }
            }
            queue.sort(null);
        }

        if(queue.size() == 0){
            return new int[] {0, 0};
        }
        int max = queue.get(queue.size()-1);
        int min = queue.get(0);

        return new int[] {max, min};
    }
}