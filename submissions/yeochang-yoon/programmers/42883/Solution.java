import java.io.*;
import java.util.*;

class Solution {

    long max = 0;

    public String solution(String number, int k) {

        List<Integer> list = new ArrayList<>();

        for(int i = 0; i < number.length(); i++){
            list.add(number.charAt(i) - '0');
        }

        int count = 0;

        for(int i = 0; i < list.size()-1; i++){
            if(count >= k){
                break;
            }
            if(list.get(i) < list.get(i+1)){
                list.remove(i);
                count++;
                if(i == 0){
                    i--;
                }else{
                    i-=2;
                }

            }
        }

        while(count < k){
            list.remove(list.size()-1);
            count++;
        }


        StringBuilder sb = new StringBuilder();
        for(int i = 0; i < list.size(); i++){
            sb.append(list.get(i));
        }

        return sb.toString();
    }


}