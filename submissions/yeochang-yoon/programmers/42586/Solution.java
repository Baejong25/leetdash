import java.util.*;

class Solution {
    public int[] solution(int[] progresses, int[] speeds) {
        int count = 0;
        List<Integer> list = new ArrayList<>();

        while(count < progresses.length){
            int s = 0;
            for(int i = count; i < progresses.length; i++){
                progresses[i] += speeds[i];
            }
            for(int i = count; i < progresses.length; i++){
                if(progresses[i] >= 100){
                    s++;
                }else{
                    break;
                }
            }

            if(s > 0){
                list.add(s);
                count += s;
            }
        }


        int[] result = new int[list.size()];
        for(int i = 0; i < list.size(); i++){
            result[i] = list.get(i);
        }

        return result;
    }
}